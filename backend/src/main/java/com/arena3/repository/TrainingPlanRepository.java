package com.arena3.repository;

import com.arena3.entity.TrainingPlanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TrainingPlanRepository extends JpaRepository<TrainingPlanEntity, UUID> {
    List<TrainingPlanEntity> findByUserId(UUID userId);
    List<TrainingPlanEntity> findByClassId(UUID classId);
}
