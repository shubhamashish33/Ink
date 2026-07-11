package com.shubham.ink.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.shubham.ink.auth.dto.AuthTokenResponse;
import com.shubham.ink.auth.dto.LoginRequest;
import com.shubham.ink.auth.dto.RefreshTokenRequest;
import com.shubham.ink.auth.dto.RegisterRequest;
import com.shubham.ink.common.exception.DuplicateResourceException;
import com.shubham.ink.common.exception.InvalidCredentialsException;
import com.shubham.ink.security.JwtService;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;
import com.shubham.ink.user.UserRole;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository, refreshTokenRepository, passwordEncoder, jwtService, 30);
    }

    @Test
    void registerNormalizesInputAndHashesPassword() {
        RegisterRequest request = new RegisterRequest(
                "  Test@Example.COM  ", "StrongPassword123!", "  Test User  ");
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("StrongPassword123!")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
            return user;
        });

        var response = authService.register(request);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getEmail()).isEqualTo("test@example.com");
        assertThat(savedUser.getPasswordHash()).isEqualTo("encoded-password");
        assertThat(savedUser.getDisplayName()).isEqualTo("Test User");
        assertThat(savedUser.getRole()).isEqualTo(UserRole.USER);
        assertThat(response.email()).isEqualTo("test@example.com");
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("test@example.com", "StrongPassword123!", "Test User")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessage("Email already registered");

        verify(userRepository, never()).save(any());
    }

    @Test
    void loginReturnsAccessAndRefreshTokensForValidCredentials() {
        User user = user();
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password", "encoded-password")).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("access-token");
        when(jwtService.getAccessTokenTtlMinutes()).thenReturn(60L);

        AuthTokenResponse response = authService.login(
                new LoginRequest("  Test@Example.COM ", "correct-password"));

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresinMinutes()).isEqualTo(60);
        assertThat(response.user().email()).isEqualTo("test@example.com");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void loginUsesSameErrorForUnknownEmailAndWrongPassword() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("missing@example.com", "password")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        User user = user();
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("test@example.com", "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refreshRotatesAValidRefreshToken() {
        User user = user();
        RefreshToken oldToken = new RefreshToken(user, hash("old-refresh-token"), Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(hash("old-refresh-token")))
                .thenReturn(Optional.of(oldToken));
        when(jwtService.generateAccessToken(user)).thenReturn("new-access-token");
        when(jwtService.getAccessTokenTtlMinutes()).thenReturn(60L);

        AuthTokenResponse response = authService.refresh(new RefreshTokenRequest("old-refresh-token"));

        assertThat(response.accessToken()).isEqualTo("new-access-token");
        assertThat(response.refreshToken()).isNotEqualTo("old-refresh-token");
        verify(refreshTokenRepository).delete(oldToken);
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void refreshDeletesAndRejectsAnExpiredToken() {
        RefreshToken expiredToken = new RefreshToken(
                user(), hash("expired-token"), Instant.now().minusSeconds(1));
        when(refreshTokenRepository.findByTokenHash(hash("expired-token")))
                .thenReturn(Optional.of(expiredToken));

        assertThatThrownBy(() -> authService.refresh(new RefreshTokenRequest("expired-token")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Refresh token expired");

        verify(refreshTokenRepository).delete(expiredToken);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refreshRejectsUnknownTokenAndLogoutDeletesByHash() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh(new RefreshTokenRequest("unknown-token")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid refresh token");

        authService.logout(new RefreshTokenRequest("logout-token"));

        verify(refreshTokenRepository).deleteByTokenHash(hash("logout-token"));
    }

    private User user() {
        User user = new User("test@example.com", "encoded-password", "Test User", UserRole.USER);
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
