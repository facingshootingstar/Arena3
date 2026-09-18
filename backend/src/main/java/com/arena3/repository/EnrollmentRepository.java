package com.arena3.repository;

import com.arena3.entity.EnrollmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<EnrollmentEntity, UUID> {
    List<EnrollmentEntity> findByClassId(UUID classId);
    List<EnrollmentEntity> findByUserId(UUID userId);
    Optional<EnrollmentEntity> findByClassIdAndUserId(UUID classId, UUID userId);
}
