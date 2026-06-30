package com.shubham.ink.auth;

import com.shubham.ink.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.shubham.ink.auth.dto.AuthTokenResponse;
import com.shubham.ink.auth.dto.AuthUserResponse;
import com.shubham.ink.auth.dto.LoginRequest;
import com.shubham.ink.auth.dto.RegisterRequest;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;
import com.shubham.ink.user.UserRole;

import com.shubham.ink.common.exception.DuplicateResourceException;
import com.shubham.ink.common.exception.InvalidCredentialsException;
@Service
public class AuthService {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

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

    public AuthTokenResponse login(LoginRequest request) {

        String email = request.email().trim().toLowerCase();

        User user = userRepository.findByEmail(email).orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        AuthUserResponse userResponse = new AuthUserResponse(
            user.getId(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole()
        );

        return new AuthTokenResponse(
            jwtService.generateAccessToken(user),
            "Bearer",
            jwtService.getAccessTokenTtlMinutes(),
            userResponse
        );

    }
}
