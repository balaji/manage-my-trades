"""
Machine learning model metadata.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, Boolean
from app.db.session import Base
from app.models.base import TimestampMixin


class MLModel(Base, TimestampMixin):
    """ML model metadata."""

    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    model_type = Column(String(100), nullable=False)  # random_forest, gradient_boosting, svm
    task_type = Column(String(50), nullable=False)  # classification, regression
    symbols = Column(JSON, nullable=False)  # Symbols used for training
    features = Column(JSON, nullable=False)  # Feature configuration
    hyperparameters = Column(JSON, nullable=False, default={})
    trained_at = Column(DateTime, nullable=True)
    training_duration = Column(Float, nullable=True)  # seconds
    file_path = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=False)
    description = Column(Text, nullable=True)

    # Training metadata
    train_start_date = Column(DateTime, nullable=True)
    train_end_date = Column(DateTime, nullable=True)
    test_start_date = Column(DateTime, nullable=True)
    test_end_date = Column(DateTime, nullable=True)


class MLModelMetrics(Base, TimestampMixin):
    """ML model performance metrics."""

    __tablename__ = "ml_model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, nullable=False, index=True)
    dataset_type = Column(String(20), nullable=False)  # train, validation, test

    # Classification metrics
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    roc_auc = Column(Float, nullable=True)
    confusion_matrix = Column(JSON, nullable=True)

    # Regression metrics
    mse = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    r2_score = Column(Float, nullable=True)

    # Additional data
    class_distribution = Column(JSON, nullable=True)
    feature_importance = Column(JSON, nullable=True)
