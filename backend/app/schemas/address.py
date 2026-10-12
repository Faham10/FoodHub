from typing import Optional

from pydantic import BaseModel


class AddressBase(BaseModel):
    full_name: str
    phone: str
    address_line: str
    area: Optional[str] = None
    city: str
    postal_code: Optional[str] = None
    instructions: Optional[str] = None
    is_default: bool = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    instructions: Optional[str] = None
    is_default: Optional[bool] = None


class AddressOut(AddressBase):
    id: int

    class Config:
        from_attributes = True
