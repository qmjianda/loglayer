"""Typed boundary models for the LogLayer plugin protocol."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from packaging.specifiers import SpecifierSet
from packaging.version import Version
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

CAPABILITY_TYPES = ("FILTER", "TRANSFORM", "RENDERING", "UIWidget")
WIDGET_SLOTS = ("sidebar", "inspector", "statusbar", "editor_toolbar")
KNOWN_RENDERERS = {
    "builtin.highlight",
    "builtin.rowtint",
    "builtin.level",
    "builtin.bookmark",
    "builtin.metric",
}
HOST_API_VERSION = "1.0.0"


class ManifestValidationError(ValueError):
    code = "invalid_manifest"

    def __init__(self, message: str, code: str = "invalid_manifest") -> None:
        super().__init__(message)
        self.code = code


class CapabilityDeclaration(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1)
    type: Literal["FILTER", "TRANSFORM", "RENDERING", "UIWidget"]
    version: str = Field(min_length=1)
    display_name: str = ""
    description: str = ""
    icon: str = "default"
    category: str | None = None
    stage: str = "logic"
    ui_schema: Any = None
    slot: str | None = None
    renderer_id: str | None = None

    @model_validator(mode="after")
    def validate_widget_metadata(self) -> "CapabilityDeclaration":
        if self.type == "UIWidget":
            if self.slot not in WIDGET_SLOTS or self.renderer_id not in KNOWN_RENDERERS:
                raise ValueError("UIWidget must use a fixed slot and known renderer")
        if self.type == "RENDERING" and self.renderer_id not in KNOWN_RENDERERS:
            raise ValueError("RENDERING must use a known renderer")
        return self


class PluginManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    version: str = Field(min_length=1)
    api: str = Field(min_length=1)
    entry: str = Field(min_length=1)
    capabilities: list[CapabilityDeclaration]

    @classmethod
    def model_validate(cls, obj: Any, *, strict: bool | None = None, from_attributes: bool | None = None, context: Any = None) -> "PluginManifest":
        try:
            return super().model_validate(obj, strict=strict, from_attributes=from_attributes, context=context)
        except ValidationError as error:
            code = "invalid_widget_metadata" if "UIWidget" in str(error) or "floating-window" in str(error) else "invalid_manifest"
            raise ManifestValidationError(str(error), code) from error

    def is_api_compatible(self, host_version: str = HOST_API_VERSION) -> bool:
        try:
            return Version(host_version) in SpecifierSet(self.api)
        except (ValueError, TypeError):
            return False

    def compatibility_diagnostic(self, host_version: str = HOST_API_VERSION) -> "PluginDiagnostic":
        return PluginDiagnostic(
            plugin_id=self.id,
            stage="compatibility",
            code="incompatible_api",
            message=f"Plugin API range {self.api!r} excludes host {host_version}",
        )


class ManifestLoader:
    def __init__(self, api_version: str = HOST_API_VERSION) -> None:
        self.api_version = api_version

    def load_file(self, path: Path) -> PluginManifest:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            manifest = PluginManifest.model_validate(data)
        except ManifestValidationError:
            raise
        except (OSError, ValueError, TypeError) as error:
            raise ManifestValidationError(str(error)) from error
        if not manifest.is_api_compatible(self.api_version):
            raise ManifestValidationError(manifest.compatibility_diagnostic(self.api_version).message, "incompatible_api")
        return manifest


class PluginDiagnostic(BaseModel):
    plugin_id: str | None = None
    source: str | None = None
    stage: str
    code: str
    message: str
    exception_type: str | None = None


class PluginOutcome(BaseModel):
    state: Literal["discovered", "registered", "failed", "disabled"]
    diagnostic: PluginDiagnostic | None = None
