package com.arena3.repository;

import com.arena3.entity.OtpChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OtpChallengeRepository extends JpaRepository<OtpChallengeEntity, UUID> {
    Optional<OtpChallengeEntity> findTopByPhoneAndPurposeOrderByExpiresAtDesc(String phone, String purpose);
}
