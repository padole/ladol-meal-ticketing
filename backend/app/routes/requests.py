"""Client dining service requests."""
from flask import Blueprint, abort, request

from ..extensions import db
from ..models import ServiceRequest
from ..utils import body, company_by_code, admin_required, parse_date, require

bp = Blueprint("requests", __name__)

# ---- Client dining requests (admins): list, create, approve/reject ----
STATUSES = ("Pending", "Approved", "Rejected", "Completed")


@bp.get("/requests")
@admin_required
def list_requests():
    q = ServiceRequest.query
    if request.args.get("status"):
        q = q.filter(ServiceRequest.status == request.args["status"])
    return [r.to_dict() for r in q.order_by(ServiceRequest.created_at.desc(), ServiceRequest.id.desc())]


@bp.post("/requests")
@admin_required
def create_request():
    data = body()
    require(data, "company", "requested_by", "meal_type", "guests")
    r = ServiceRequest(company=company_by_code(data["company"]), requested_by=data["requested_by"],
                       meal_type=data["meal_type"], guests=int(data["guests"]),
                       service_date=parse_date(data.get("service_date")), status="Pending")
    db.session.add(r)
    db.session.commit()
    return r.to_dict(), 201


@bp.patch("/requests/<int:req_id>")
@admin_required
def set_status(req_id):
    status = body().get("status")
    if status not in STATUSES:
        abort(400, f"status must be one of {', '.join(STATUSES)}")
    r = db.get_or_404(ServiceRequest, req_id)
    r.status = status
    db.session.commit()
    return r.to_dict()
