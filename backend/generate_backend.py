import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

# ================= ENTITIES =================
w("entity/UserEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "member_code", unique = true, length = 16)
    private String memberCode;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "name_normalized", nullable = false, length = 120)
    private String nameNormalized;

    @Column(nullable = false, unique = true, length = 16)
    private String phone;

    @Column(unique = true, length = 190)
    private String email;

    @Column(nullable = false, length = 32)
    private String role; // manager, coach, receptionist, member

    @Column(nullable = false, length = 32)
    private String status = "active"; // active, locked, disabled

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    @Column(name = "failed_logins", nullable = false)
    private int failedLogins = 0;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "guardian_name", length = 120)
    private String guardianName;

    @Column(name = "guardian_phone", length = 16)
    private String guardianPhone;

    @Column(name = "national_id", length = 20)
    private String nationalId;

    @Column(name = "pii_consent_at")
    private OffsetDateTime piiConsentAt;

    @Column(name = "health_notes", columnDefinition = "TEXT")
    private String healthNotes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
""")

w("entity/CenterSettingsEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "center_settings")
@Getter
@Setter
@NoArgsConstructor
public class CenterSettingsEntity {
    @Id
    private Short id = 1;

    @Column(nullable = false)
    private String timezone = "Asia/Ho_Chi_Minh";

    @Column(nullable = false, length = 3)
    private String currency = "VND";

    @Column(name = "open_time", nullable = false)
    private String openTime = "06:00";

    @Column(name = "close_time", nullable = false)
    private String closeTime = "22:00";

    @Column(name = "slot_minutes", nullable = false)
    private int slotMinutes = 60;

    @Column(name = "hold_minutes", nullable = false)
    private int holdMinutes = 5;

    @Column(name = "book_ahead_days", nullable = false)
    private int bookAheadDays = 7;

    @Column(name = "max_slots_per_day", nullable = false)
    private int maxSlotsPerDay = 2;

    @Column(name = "cancel_court_hours", nullable = false)
    private int cancelCourtHours = 2;

    @Column(name = "cancel_class_hours", nullable = false)
    private int cancelClassHours = 4;

    @Column(name = "noshow_grace_minutes", nullable = false)
    private int noshowGraceMinutes = 10;

    @Column(name = "checkin_before_minutes", nullable = false)
    private int checkinBeforeMinutes = 15;

    @Column(name = "debt_limit_vnd", nullable = false)
    private int debtLimitVnd = 500000;

    @Column(name = "refund_manager_vnd", nullable = false)
    private int refundManagerVnd = 1000000;

    @Column(name = "freeze_max_days_year", nullable = false)
    private int freezeMaxDaysYear = 30;

    @Column(name = "minor_age", nullable = false)
    private int minorAge = 16;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(name = "round_vnd", nullable = false)
    private int roundVnd = 1000;

    @Column(name = "waitlist_offer_hours", nullable = false)
    private int waitlistOfferHours = 2;

    @Column(name = "deposit_pct_activates")
    private Integer depositPctActivates;

    @Column(name = "tax_code", length = 20)
    private String taxCode;

    @Column(name = "legal_name", length = 190)
    private String legalName = "Arena3 Sports Center";

    @Column(columnDefinition = "TEXT")
    private String address = "TP. Hồ Chí Minh";
}
""")

w("entity/CoachSportEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "coach_sports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(CoachSportEntity.CoachSportId.class)
public class CoachSportEntity {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(length = 32)
    private String sport;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CoachSportId implements Serializable {
        private UUID userId;
        private String sport;
    }
}
""")

w("entity/MembershipPlanEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "membership_plans")
@Getter
@Setter
@NoArgsConstructor
public class MembershipPlanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "sport_scope", nullable = false, length = 32)
    private String sportScope;

    @Column(name = "duration_days")
    private Integer durationDays;

    @Column(name = "session_quota")
    private Integer sessionQuota;

    @Column(name = "court_hours", nullable = false)
    private int courtHours = 0;

    @Column(name = "court_discount_pct", nullable = false)
    private int courtDiscountPct = 0;

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @Column(name = "is_on_sale", nullable = false)
    private boolean isOnSale = true;

    @Column(name = "carry_over_hours", nullable = false)
    private boolean carryOverHours = false;
}
""")

w("entity/SubscriptionEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class SubscriptionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Column(name = "sport_scope", nullable = false, length = 32)
    private String sportScope;

    @Column(name = "start_on", nullable = false)
    private LocalDate startOn;

    @Column(name = "end_on", nullable = false)
    private LocalDate endOn;

    @Column(nullable = false, length = 32)
    private String status = "pending";

    @Column(name = "court_hours_left", nullable = false)
    private BigDecimal courtHoursLeft = BigDecimal.ZERO;

    @Column(name = "session_left")
    private Integer sessionLeft;

    @Column(name = "frozen_days", nullable = false)
    private int frozenDays = 0;
}
""")

w("entity/CourtEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "courts")
@Getter
@Setter
@NoArgsConstructor
public class CourtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "court_code", nullable = false, unique = true, length = 8)
    private String courtCode;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(nullable = false, length = 32)
    private String status = "ready";

    @Column(nullable = false)
    private boolean convertible = false;

    @Column(name = "pair_court_id")
    private UUID pairCourtId;
}
""")

w("entity/OccupancyEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "occupancies")
@Getter
@Setter
@NoArgsConstructor
public class OccupancyEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(nullable = false, length = 32)
    private String kind; // session, booking, hold, maintenance, convert

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    @Column(name = "convert_group_id")
    private UUID convertGroupId;

    @Column(columnDefinition = "TEXT")
    private String reason;
}
""")

w("entity/CoachOccupancyEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "coach_occupancies")
@Getter
@Setter
@NoArgsConstructor
public class CoachOccupancyEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;
}
""")

w("entity/PriceRuleEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "price_rules")
@Getter
@Setter
@NoArgsConstructor
public class PriceRuleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(name = "court_id")
    private UUID courtId;

    @Column(name = "day_kind", nullable = false, length = 16)
    private String dayKind; // weekday, weekend, holiday

    @Column(name = "start_local", nullable = false, length = 8)
    private String startLocal;

    @Column(name = "end_local", nullable = false, length = 8)
    private String endLocal;

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @Column(name = "is_peak", nullable = false)
    private boolean isPeak = false;

    @Column(name = "start_min")
    private Integer startMin;

    @Column(name = "end_min")
    private Integer endMin;

    @PrePersist
    @PreUpdate
    public void computeMinutes() {
        if (startLocal != null && startLocal.contains(":")) {
            String[] parts = startLocal.split(":");
            this.startMin = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        }
        if (endLocal != null && endLocal.contains(":")) {
            String[] parts = endLocal.split(":");
            this.endMin = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        }
    }
}
""")

w("entity/ClassEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "classes")
@Getter
@Setter
@NoArgsConstructor
public class ClassEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(nullable = false, length = 24)
    private String level;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(name = "assistant_id")
    private UUID assistantId;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "enrolled_count", nullable = false)
    private int enrolledCount = 0;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rrule;

    @Column(name = "duration_min", nullable = false)
    private int durationMin = 90;

    @Column(name = "start_on", nullable = false)
    private LocalDate startOn;

    @Column(name = "end_on", nullable = false)
    private LocalDate endOn;

    @Column(nullable = false, length = 32)
    private String status = "draft"; // draft, open, closed, cancelled
}
""")

w("entity/SessionEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "sessions")
@Getter
@Setter
@NoArgsConstructor
public class SessionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "class_id", nullable = false)
    private UUID classId;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(nullable = false, length = 32)
    private String status = "scheduled"; // scheduled, done, cancelled

    @Column(name = "occupancy_id")
    private UUID occupancyId;
}
""")

w("entity/EnrollmentEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "enrollments")
@Getter
@Setter
@NoArgsConstructor
public class EnrollmentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "class_id", nullable = false)
    private UUID classId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 32)
    private String status; // confirmed, waitlisted, cancelled

    @Column(name = "waitlist_pos")
    private Integer waitlistPos;
}
""")

w("entity/CourtBookingEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "court_bookings")
@Getter
@Setter
@NoArgsConstructor
public class CourtBookingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String code;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "guest_name", length = 120)
    private String guestName;

    @Column(name = "guest_phone", length = 16)
    private String guestPhone;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(nullable = false, length = 32)
    private String status; // hold, confirmed, in_use, completed, cancelled, no_show

    @Column(nullable = false, length = 12)
    private String channel = "app";

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @Column(name = "discount_pct", nullable = false)
    private int discountPct = 0;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(name = "hold_until")
    private OffsetDateTime holdUntil;

    @Column(name = "occupancy_id")
    private UUID occupancyId;

    @Column(name = "quota_hours", nullable = false)
    private BigDecimal quotaHours = BigDecimal.ZERO;
}
""")

w("entity/CashierShiftEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cashier_shifts")
@Getter
@Setter
@NoArgsConstructor
public class CashierShiftEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "receptionist_id", nullable = false)
    private UUID receptionistId;

    @Column(name = "opened_at", nullable = false)
    private OffsetDateTime openedAt = OffsetDateTime.now();

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "cash_declared_vnd")
    private Integer cashDeclaredVnd;
}
""")

w("entity/PaymentEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class PaymentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String code;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(nullable = false, length = 32)
    private String method; // cash, transfer, card, gateway, quota

    @Column(name = "amount_vnd", nullable = false)
    private int amountVnd;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(nullable = false, length = 32)
    private String status = "posted"; // posted, refund_pending, refund_rejected

    @Column(name = "ref_type", nullable = false, length = 24)
    private String refType; // booking, subscription, walkin, equipment

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
""")

w("entity/InvoiceEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class InvoiceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String code;

    @Column(name = "payment_id", nullable = false, unique = true)
    private UUID paymentId;

    @Column(name = "buyer_name", nullable = false, length = 120)
    private String buyerName;

    @Column(name = "buyer_tax_code", length = 20)
    private String buyerTaxCode;

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt = OffsetDateTime.now();
}
""")

w("entity/InvoiceLineEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "invoice_lines")
@Getter
@Setter
@NoArgsConstructor
public class InvoiceLineEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private int qty = 1;

    @Column(name = "unit_vnd", nullable = false)
    private int unitVnd;

    @Column(name = "amount_vnd", nullable = false)
    private int amountVnd;
}
""")

w("entity/EquipmentItemEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "equipment_items")
@Getter
@Setter
@NoArgsConstructor
public class EquipmentItemEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String sku;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 32)
    private String sport;

    @Column(nullable = false)
    private int stock = 0;

    @Column(name = "rent_vnd", nullable = false)
    private int rentVnd = 0;
}
""")

w("entity/EquipmentLoanEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "equipment_loans")
@Getter
@Setter
@NoArgsConstructor
public class EquipmentLoanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(nullable = false, length = 16)
    private String phone;

    @Column(nullable = false)
    private int qty;

    @Column(nullable = false, length = 32)
    private String status = "out"; // out, returned, lost

    @Column(name = "due_at", nullable = false)
    private OffsetDateTime dueAt;

    @Column(name = "returned_at")
    private OffsetDateTime returnedAt;
}
""")

w("entity/AttendanceEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "attendance")
@Getter
@Setter
@NoArgsConstructor
public class AttendanceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 32)
    private String kind; // session, gate

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(length = 32)
    private String result; // present, late, absent, excused

    @Column(nullable = false)
    private OffsetDateTime at = OffsetDateTime.now();
}
""")

w("entity/TrainingPlanEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "training_plans")
@Getter
@Setter
@NoArgsConstructor
public class TrainingPlanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 16)
    private String scope; // class, member

    @Column(name = "class_id")
    private UUID classId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 8)
    private String source = "coach"; // coach, gemini

    @Column(nullable = false)
    private boolean published = false;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;
}
""")

w("entity/TicketEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
public class TicketEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false, length = 16)
    private String status = "open";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
""")

w("entity/AuditLogEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLogEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private OffsetDateTime at = OffsetDateTime.now();

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(nullable = false, length = 64)
    private String entity;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(columnDefinition = "TEXT")
    private String before;

    @Column(columnDefinition = "TEXT")
    private String after;
}
""")

w("entity/FeatureFlagEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "feature_flags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FeatureFlagEntity {
    @Id
    @Column(length = 16)
    private String key;

    @Column(nullable = false)
    private boolean enabled = false;
}
""")

w("entity/CodeCounterEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Entity
@Table(name = "code_counters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(CodeCounterEntity.CodeCounterId.class)
public class CodeCounterEntity {
    @Id
    @Column(length = 16)
    private String kind;

    @Id
    private int yyyy;

    @Column(nullable = false)
    private int n;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CodeCounterId implements Serializable {
        private String kind;
        private int yyyy;
    }
}
""")

w("entity/SessionAuthEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "sessions_auth")
@Getter
@Setter
@NoArgsConstructor
public class SessionAuthEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
""")

w("entity/OtpChallengeEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "otp_challenges")
@Getter
@Setter
@NoArgsConstructor
public class OtpChallengeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 16)
    private String phone;

    @Column(nullable = false, length = 16)
    private String purpose;

    @Column(name = "otp_hash", nullable = false)
    private String otpHash;

    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(nullable = false)
    private int attempts = 0;
}
""")

w("entity/OutboxEntity.java", """
package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "outbox")
@Getter
@Setter
@NoArgsConstructor
public class OutboxEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 12)
    private String channel;

    @Column(nullable = false, length = 32)
    private String template;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "dedupe_key", nullable = false, unique = true, length = 160)
    private String dedupeKey;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
""")

print("Done writing entities!")
