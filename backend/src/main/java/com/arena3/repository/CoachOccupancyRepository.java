package com.arena3.repository;

import com.arena3.entity.CoachOccupancyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface CoachOccupancyRepository extends JpaRepository<CoachOccupancyEntity, UUID> {
    @Query("SELECT c FROM CoachOccupancyEntity c WHERE c.coachId = :coachId AND c.startAt < :endAt AND c.endAt > :startAt")
    List<CoachOccupancyEntity> findOverlapping(
            @Param("coachId") UUID coachId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    void deleteBySessionId(UUID sessionId);
}
