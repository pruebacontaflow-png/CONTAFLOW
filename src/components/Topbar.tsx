"use client";

import { useState, createContext, useContext } from "react";
import { ChevronDown } from "lucide-react";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

interface FilterContextType {
  year: number;
  semestre: 1 | 2;
  setYear: (y: number) => void;
  setSemestre: (s: 1 | 2) => void;
}

export const FilterContext = createContext<FilterContextType>({
  year: currentYear,
  semestre: 1,
  setYear: () => {},
  setSemestre: () => {},
});

export function useFilters() {
  return useContext(FilterContext);
}

export function Topbar({ title }: { title?: string }) {
  return (
    <header style={{
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      background: 'white',
      borderBottom: '0.5px solid rgba(0,0,0,0.10)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
        {title}
      </div>
    </header>
  );
}
