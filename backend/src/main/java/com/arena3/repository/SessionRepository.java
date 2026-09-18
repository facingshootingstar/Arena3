package com.arena3.repository;

import com.arena3.entity.SessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<SessionEntity, UUID> {
    List<SessionEntity> findByClassId(UUID classId);
    List<SessionEntity> findByCourtId(UUID courtId);
    List<SessionEntity> findByStartAtBetween(OffsetDateTime start, OffsetDateTime end);
}
