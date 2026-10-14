import math
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple, Union
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.admin_user import AdminUser
from app.models.workday_employee import WorkdayEmployee
from app.repositories.admin_user_repository import AdminUserRepository
from app.schemas.admin_user import (
    AdminUserResponse,
    AdminUserCreateRequest,
    AvailableAdminUserItem,
    AdminUserSummaryItem,
    AdminUserBulkResponse,
)
from app.schemas.common import PaginatedResponse
from app.schemas.employee import EmployeeSummary


class AdminUserService:
    """
    Business logic for Authorized Admin User management and Workday correlation.
    """

    @classmethod
    def list_admin_users(cls, db: Session) -> List[AdminUserResponse]:
        rows = AdminUserRepository.list_admin_users(db)
        items: List[AdminUserResponse] = []

        for admin, emp in rows:
            emp_summary = EmployeeSummary.model_validate(emp) if emp else None
            payload = {
                "admin_user_id": admin.admin_user_id,
                "adminUserId": admin.admin_user_id,
                "user_id": admin.admin_user_id,
                "userId": admin.admin_user_id,
                "created_at": admin.created_at,
                "full_name": emp.full_name if emp else None,
                "fullName": emp.full_name if emp else None,
                "email_work": emp.email_work if emp else None,
                "emailWork": emp.email_work if emp else None,
                "department": emp.department if emp else None,
                "division": emp.division if emp else None,
                "job_title": emp.job_title if emp else None,
                "jobTitle": emp.job_title if emp else None,
                "employee_status": emp.employee_status if emp else None,
                "employeeStatus": emp.employee_status if emp else None,
                "manager_name": emp.manager_name if emp else None,
                "manager_user_name": emp.manager_user_name if emp else None,
                "location": emp.location if emp else None,
                "employee": emp_summary,
                "workday_employee": emp_summary,
            }
            items.append(AdminUserResponse.model_validate(payload))

        return items

    @classmethod
    def get_available_users(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        user_id: Optional[str] = None,
        full_name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> PaginatedResponse[AvailableAdminUserItem]:
        """
        Retrieves employees from workday_employees who are not currently registered as admins.
        Supports searching by user ID, full name, work email, and pagination.
        """
        employees, total = AdminUserRepository.list_available_users(
            db=db,
            page=page,
            page_size=page_size,
            search=search,
            user_id=user_id,
            full_name=full_name,
            email=email,
        )

        items = [AvailableAdminUserItem.model_validate(emp) for emp in employees]
        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return PaginatedResponse(
            items=items,
            data=items,
            total=total,
            total_items=total,
            total_pages=total_pages,
            totalPages=total_pages,
            page=page,
            page_size=page_size,
            pageSize=page_size,
        )

    @classmethod
    def add_admin_users(
        cls, db: Session, payload: AdminUserCreateRequest
    ) -> AdminUserBulkResponse:
        """
        Bulk adds authorized admin users transactionally.
        1. Verifies that each user_id exists in workday_employees.
        2. Stores that exact user_id in admin_users.admin_user_id.
        3. Prevents duplicate admin entries.
        4. Inserts all valid new users using a database transaction.
        5. Returns a clear summary of inserted users and any skipped or invalid IDs.
        """
        candidate_ids: List[str] = []

        if payload.user_ids:
            candidate_ids.extend(payload.user_ids)
        if payload.userIds:
            candidate_ids.extend(payload.userIds)
        if payload.admin_user_ids:
            candidate_ids.extend(payload.admin_user_ids)
        if payload.adminUserIds:
            candidate_ids.extend(payload.adminUserIds)
        if payload.user_id:
            candidate_ids.append(payload.user_id)
        if payload.userId:
            candidate_ids.append(payload.userId)
        if payload.admin_user_id:
            candidate_ids.append(payload.admin_user_id)
        if payload.adminUserId:
            candidate_ids.append(payload.adminUserId)
        if payload.users:
            for u in payload.users:
                if isinstance(u, str):
                    candidate_ids.append(u)
                elif hasattr(u, "admin_user_id") and u.admin_user_id:
                    candidate_ids.append(u.admin_user_id)
                elif hasattr(u, "user_id") and u.user_id:
                    candidate_ids.append(u.user_id)

        # Deduplicate candidate inputs in order of appearance
        seen_candidates = set()
        unique_candidates: List[str] = []
        for raw in candidate_ids:
            clean = str(raw).strip()
            if clean and clean.lower() not in seen_candidates:
                seen_candidates.add(clean.lower())
                unique_candidates.append(clean)

        inserted_summaries: List[AdminUserSummaryItem] = []
        skipped_ids: List[str] = []
        invalid_ids: List[str] = []

        if not unique_candidates:
            all_admins = cls.list_admin_users(db)
            return AdminUserBulkResponse(
                message="No users selected for admin authorization",
                inserted=[],
                skipped=[],
                invalid=[],
                total_inserted=0,
                total_skipped=0,
                total_invalid=0,
                admin_users=all_admins,
            )

        # Query existing admin users
        existing_admins = db.execute(select(AdminUser)).scalars().all()
        existing_admin_set = {a.admin_user_id.lower(): a.admin_user_id for a in existing_admins}

        # Query Workday employees matching candidate IDs
        candidate_lowers = [uid.lower() for uid in unique_candidates]
        emp_stmt = select(WorkdayEmployee).where(
            func.lower(WorkdayEmployee.user_id).in_(candidate_lowers)
        )
        matching_emps = {e.user_id.lower(): e for e in db.execute(emp_stmt).scalars().all()}

        # Classify each candidate
        to_insert: List[Tuple[str, WorkdayEmployee]] = []
        for uid in unique_candidates:
            clean_lower = uid.lower()

            # 1. Verify existence in workday_employees
            if clean_lower not in matching_emps:
                invalid_ids.append(uid)
                continue

            # 2. Prevent duplicate admin entries
            if clean_lower in existing_admin_set:
                skipped_ids.append(uid)
                continue

            emp = matching_emps[clean_lower]
            # Exact user_id from Workday
            to_insert.append((emp.user_id, emp))
            # Mark as handled in this batch so duplicates within same batch are skipped
            existing_admin_set[clean_lower] = emp.user_id

        # 3. Transactional insertion of valid users
        now_utc = datetime.now(timezone.utc)
        try:
            for exact_user_id, emp in to_insert:
                new_admin = AdminUser(
                    admin_user_id=exact_user_id,
                    created_at=now_utc,
                )
                db.add(new_admin)
                inserted_summaries.append(
                    AdminUserSummaryItem(
                        user_id=exact_user_id,
                        admin_user_id=exact_user_id,
                        full_name=emp.full_name,
                        email_work=emp.email_work,
                        employee_status=emp.employee_status,
                        department=emp.department,
                    )
                )
            db.commit()
        except Exception as exc:
            db.rollback()
            raise exc

        all_admins = cls.list_admin_users(db)

        return AdminUserBulkResponse(
            message=f"Admin users processed: {len(inserted_summaries)} inserted, {len(skipped_ids)} skipped, {len(invalid_ids)} invalid",
            inserted=inserted_summaries,
            skipped=skipped_ids,
            invalid=invalid_ids,
            total_inserted=len(inserted_summaries),
            total_skipped=len(skipped_ids),
            total_invalid=len(invalid_ids),
            admin_users=all_admins,
        )

    @classmethod
    def delete_admin_user(cls, db: Session, admin_user_id: str) -> dict:
        deleted = AdminUserRepository.delete_admin_user(db, admin_user_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Admin user '{admin_user_id}' not found",
            )
        return {
            "message": f"Admin user '{admin_user_id}' removed successfully",
            "admin_user_id": admin_user_id,
        }

