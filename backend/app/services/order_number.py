from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.order import BranchOrderSequence


def next_order_number(db: Session, branch_id: int) -> str:
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        insert = postgresql_insert
    elif dialect == "sqlite":
        insert = sqlite_insert
    else:
        raise RuntimeError(f"Branch order numbering is not implemented for database dialect '{dialect}'")

    db.execute(
        insert(BranchOrderSequence)
        .values(branch_id=branch_id, last_number=0)
        .on_conflict_do_nothing(index_elements=[BranchOrderSequence.branch_id])
    )
    sequence_number = db.execute(
        update(BranchOrderSequence)
        .where(BranchOrderSequence.branch_id == branch_id)
        .values(last_number=BranchOrderSequence.last_number + 1)
        .returning(BranchOrderSequence.last_number)
    ).scalar_one()

    return f"B{branch_id}-{sequence_number:04d}"
