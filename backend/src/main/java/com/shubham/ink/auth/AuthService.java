package com.shubham.ink.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import com.shubham.ink.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.shubham.ink.auth.dto.AuthTokenResponse;
import com.shubham.ink.auth.dto.AuthUserResponse;
import com.shubham.ink.auth.dto.LoginRequest;
import com.shubham.ink.auth.dto.RefreshTokenRequest;
import com.shubham.ink.auth.dto.RegisterRequest;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;
import com.shubham.ink.user.UserRole;

import com.shubham.ink.common.exception.DuplicateResourceException;
import com.shubham.ink.common.exception.InvalidCredentialsException;
@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final long refreshTokenTtlDays;

    public AuthService(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        @Value("${app.jwt.refresh-token-ttl-days}") long refreshTokenTtlDays
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
    }

    @Transactional
    public AuthUserResponse register(RegisterRequest request) {

        String email = request.email().trim().toLowerCase();
        String password = request.password();

        if(userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already registered");
        }

        //User not exist
        User user = new User(
            email,
            passwordEncoder.encode(password),
            request.displayName().trim(),
            UserRole.USER
        );

        User savedUser = userRepository.save(user);

        return new AuthUserResponse(
            savedUser.getId(),
            savedUser.getEmail(),
            savedUser.getDisplayName(),
            savedUser.getRole()
        );

    }

    @Transactional
    public AuthTokenResponse login(LoginRequest request) {

        String email = request.email().trim().toLowerCase();

        User user = userRepository.findByEmail(email).orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        return createTokenResponse(user);

    }

    @Transactional
    public AuthTokenResponse refresh(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(hashToken(request.refreshToken()))
            .orElseThrow(() -> new InvalidCredentialsException("Invalid refresh token"));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new InvalidCredentialsException("Refresh token expired");
        }

        refreshTokenRepository.delete(refreshToken);

        return createTokenResponse(refreshToken.getUser());
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        refreshTokenRepository.deleteByTokenHash(hashToken(request.refreshToken()));
    }

    private AuthTokenResponse createTokenResponse(User user) {
        String rawRefreshToken = generateRefreshToken();
        refreshTokenRepository.save(new RefreshToken(
            user,
            hashToken(rawRefreshToken),
            Instant.now().plusSeconds(refreshTokenTtlDays * 24 * 60 * 60)
        ));

        AuthUserResponse userResponse = new AuthUserResponse(
            user.getId(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole()
        );

        return new AuthTokenResponse(
            jwtService.generateAccessToken(user),
            rawRefreshToken,
            "Bearer",
            jwtService.getAccessTokenTtlMinutes(),
            userResponse
        );
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[64];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
