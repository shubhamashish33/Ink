package com.shubham.ink.vault;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VaultRepository extends JpaRepository<UserVaultKey, UUID> {
}
