package com.arena3.repository;

import com.arena3.entity.CoachSportEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CoachSportRepository extends JpaRepository<CoachSportEntity, CoachSportEntity.CoachSportId> {
    List<CoachSportEntity> findByUserId(UUID userId);
}
