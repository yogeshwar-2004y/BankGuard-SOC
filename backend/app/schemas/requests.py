from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=128)


class BeneficiaryInput(Input):
    name: str = Field(min_length=2, max_length=100)
    account_number: str = Field(pattern=r"^BG-[A-Z0-9-]{3,32}$")


class TransferInput(Input):
    beneficiary_id: UUID
    amount: Decimal = Field(gt=0, le=1000000, decimal_places=2)
    reference: str = Field(default="Simulated transfer", max_length=120)


class PasswordInput(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class SimulationInput(Input):
    scenario: str = Field(max_length=40)
    guided: bool = False


class NoteInput(Input):
    content: str = Field(min_length=1, max_length=5000)


class IncidentUpdate(Input):
    status: (
        Literal["NEW", "TRIAGED", "INVESTIGATING", "CONTAINED", "REMEDIATING", "RESOLVED", "CLOSED"]
        | None
    ) = None
    assigned_to: UUID | None = None


class RuleUpdate(Input):
    enabled: bool | None = None
    weight: int | None = Field(default=None, ge=0, le=100)
    threshold: int | None = Field(default=None, ge=1, le=1000000)
    window_minutes: int | None = Field(default=None, ge=1, le=1440)
    medium: int | None = Field(default=None, ge=1, le=300)
    high: int | None = Field(default=None, ge=2, le=400)
    critical: int | None = Field(default=None, ge=3, le=500)


class ResetInput(Input):
    confirmation: Literal["RESET BANKGUARD"]


class UserUpdate(Input):
    enabled: bool


class ScenarioUpdate(Input):
    enabled: bool


class EvidenceInput(Input):
    type: Literal["Screenshot Reference", "Analyst Note"]
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=2, max_length=2000)
