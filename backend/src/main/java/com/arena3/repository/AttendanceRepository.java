package com.arena3.repository;

import com.arena3.entity.AttendanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<AttendanceEntity, UUID> {
    List<AttendanceEntity> findBySessionId(UUID sessionId);
    Optional<AttendanceEntity> findBySessionIdAndUserId(UUID sessionId, UUID userId);
}
