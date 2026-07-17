package com.shubham.ink.account.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank String currentPassword,
    @NotBlank @Size(min = 12) String newPassword,
    @NotBlank String passwordWrappedKey
) {
}
