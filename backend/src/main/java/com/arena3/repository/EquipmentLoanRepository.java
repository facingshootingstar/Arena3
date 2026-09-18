package com.arena3.repository;

import com.arena3.entity.EquipmentLoanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EquipmentLoanRepository extends JpaRepository<EquipmentLoanEntity, UUID> {
    List<EquipmentLoanEntity> findByStatus(String status);
}
