package com.arena3.repository;

import com.arena3.entity.SessionAuthEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionAuthRepository extends JpaRepository<SessionAuthEntity, UUID> {
    Optional<SessionAuthEntity> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
    void deleteByTokenHash(String tokenHash);
}
