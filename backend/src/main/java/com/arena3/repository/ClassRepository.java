package com.arena3.repository;

import com.arena3.entity.ClassEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClassRepository extends JpaRepository<ClassEntity, UUID> {
    List<ClassEntity> findByCoachId(UUID coachId);
    List<ClassEntity> findByStatus(String status);
}
