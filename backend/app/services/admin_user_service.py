from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.admin_user import AdminUser
from app.models.workday_employee import WorkdayEmployee
from app.repositories.admin_user_repository import AdminUserRepository
from app.schemas.admin_user import AdminUserResponse, AdminUserCreateRequest
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
    def add_admin_users(cls, db: Session, payload: AdminUserCreateRequest) -> List[AdminUserResponse]:
        """
        Supports single ID, list of IDs, or user object list. Handles duplicates safely.
        """
        target_ids: List[str] = []

        if payload.admin_user_id:
            target_ids.append(payload.admin_user_id)
        if payload.user_id:
            target_ids.append(payload.user_id)
        if payload.admin_user_ids:
            target_ids.extend(payload.admin_user_ids)
        if payload.user_ids:
            target_ids.extend(payload.user_ids)
        if payload.users:
            for u in payload.users:
                if u.admin_user_id:
                    target_ids.append(u.admin_user_id)

        clean_ids = list(dict.fromkeys([uid.strip() for uid in target_ids if uid and uid.strip()]))
        if not clean_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one valid admin user ID must be provided",
            )

        for uid in clean_ids:
            AdminUserRepository.add_admin_user(db, uid)

        return cls.list_admin_users(db)

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
