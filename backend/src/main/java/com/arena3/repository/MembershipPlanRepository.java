package com.arena3.repository;

import com.arena3.entity.MembershipPlanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MembershipPlanRepository extends JpaRepository<MembershipPlanEntity, UUID> {
    List<MembershipPlanEntity> findByIsOnSaleTrue();
}
