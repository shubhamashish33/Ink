package com.shubham.ink.vault.dto;

import jakarta.validation.constraints.NotBlank;

public record VaultSetupRequest(
    @NotBlank String passwordWrappedKey,
    @NotBlank String recoveryWrappedKey
) {
}
