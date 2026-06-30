package com.shubham.ink.auth.dto;

public record AuthTokenResponse(
    String accessToken,
    String tokenType,
    long expiresinMinutes,
    AuthUserResponse user
) {
    
}
