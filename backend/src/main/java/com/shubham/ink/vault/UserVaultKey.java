package com.shubham.ink.vault;

import java.time.Instant;
import java.util.UUID;

import com.shubham.ink.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "user_vault_keys")
public class UserVaultKey {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "password_wrapped_key", columnDefinition = "TEXT", nullable = false)
    private String passwordWrappedKey;

    @Column(name = "recovery_wrapped_key", columnDefinition = "TEXT", nullable = false)
    private String recoveryWrappedKey;

    @Column(name = "encryption_version", nullable = false)
    private int encryptionVersion = 2;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserVaultKey() {
    }

    public UserVaultKey(User user, String passwordWrappedKey, String recoveryWrappedKey) {
        this.user = user;
        this.passwordWrappedKey = passwordWrappedKey;
        this.recoveryWrappedKey = recoveryWrappedKey;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public String getPasswordWrappedKey() {
        return passwordWrappedKey;
    }

    public String getRecoveryWrappedKey() {
        return recoveryWrappedKey;
    }

    public int getEncryptionVersion() {
        return encryptionVersion;
    }

    public void replacePasswordWrappedKey(String passwordWrappedKey) {
        this.passwordWrappedKey = passwordWrappedKey;
    }
}
