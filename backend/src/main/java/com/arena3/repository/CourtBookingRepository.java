package com.arena3.repository;

import com.arena3.entity.CourtBookingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourtBookingRepository extends JpaRepository<CourtBookingEntity, UUID> {
    Optional<CourtBookingEntity> findByCode(String code);
    List<CourtBookingEntity> findByUserId(UUID userId);
    List<CourtBookingEntity> findByUserIdAndStatus(UUID userId, String status);
    List<CourtBookingEntity> findByGuestPhoneAndStatus(String guestPhone, String status);
}
