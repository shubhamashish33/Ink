package com.shubham.ink.auth.dto;

import java.util.UUID;

import com.shubham.ink.user.UserRole;

public record AuthUserResponse(
    UUID id,
    String email,
    String displayName,
    UserRole role
) {

}
