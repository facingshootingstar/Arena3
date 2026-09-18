package com.arena3.repository;

import com.arena3.entity.EquipmentItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EquipmentItemRepository extends JpaRepository<EquipmentItemEntity, UUID> {
    Optional<EquipmentItemEntity> findBySku(String sku);
}
