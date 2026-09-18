package com.arena3.repository;

import com.arena3.entity.OccupancyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface OccupancyRepository extends JpaRepository<OccupancyEntity, UUID> {
    @Query("SELECT o FROM OccupancyEntity o WHERE o.courtId = :courtId AND o.startAt < :endAt AND o.endAt > :startAt")
    List<OccupancyEntity> findOverlapping(
            @Param("courtId") UUID courtId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    @Query("SELECT o FROM OccupancyEntity o WHERE o.startAt < :endAt AND o.endAt > :startAt")
    List<OccupancyEntity> findInWindow(
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    List<OccupancyEntity> findByConvertGroupId(UUID convertGroupId);
}
