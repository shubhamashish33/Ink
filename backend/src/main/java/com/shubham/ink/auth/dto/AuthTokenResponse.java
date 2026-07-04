package com.shubham.ink.auth.dto;

public record AuthTokenResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresinMinutes,
    AuthUserResponse user
) {
    
}
