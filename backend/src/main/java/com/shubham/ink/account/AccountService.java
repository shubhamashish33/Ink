package com.shubham.ink.account;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.shubham.ink.account.dto.ChangePasswordRequest;
import com.shubham.ink.auth.RefreshTokenRepository;
import com.shubham.ink.common.exception.InvalidCredentialsException;
import com.shubham.ink.common.exception.ResourceNotFoundException;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;
import com.shubham.ink.vault.UserVaultKey;
import com.shubham.ink.vault.VaultRepository;

@Service
public class AccountService {

    private final UserRepository userRepository;
    private final VaultRepository vaultRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(
        UserRepository userRepository,
        VaultRepository vaultRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.vaultRepository = vaultRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Current password is incorrect");
        }

        UserVaultKey vault = vaultRepository.findById(user.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Vault not configured"));

        vault.replacePasswordWrappedKey(request.passwordWrappedKey());
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        refreshTokenRepository.deleteAllByUser_Id(user.getId());
    }
}
