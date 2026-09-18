package com.arena3.repository;

import com.arena3.entity.FeatureFlagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeatureFlagRepository extends JpaRepository<FeatureFlagEntity, String> {
}
