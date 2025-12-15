import React from "react";

export function Spinner({ size = 16, className = "" }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}