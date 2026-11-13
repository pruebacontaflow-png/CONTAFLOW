"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, FileText, ArrowDownCircle, ArrowUpCircle,
  GitCompare, BarChart3, Upload, Building2, Calendar, TrendingUp,
  LogOut, ChevronRight, ChevronDown, RefreshCw, Inbox, CreditCard, BookOpen, Percent,
  BookMarked, ListOrdered, Clock, Receipt, FileSpreadsheet, Filter, ShieldCheck, HardDrive,
  Banknote, Landmark, DollarSign, Package, BarChart2, UserCheck, FileSignature,
  Stamp, BrainCircuit, FileCheck2, PiggyBank, Boxes,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Inicio",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Tesorería",
    icon: Landmark,
    items: [
      { href: "/extractos", label: "Extractos bancarios", icon: FileSpreadsheet },
      { href: "/bancos", label: "Saldos Bancarios", icon: Building2 },
      { href: "/lote-pagos", label: "Lote de Pagos", icon: Banknote },
      { href: "/cheques", label: "Tratamiento cheques", icon: FileSignature },
      { href: "/chequeras", label: "Chequeras", icon: BookMarked },
      { href: "/tarjeta-corporativa", label: "Tarjeta corporativa", icon: CreditCard },
      { href: "/viaticos", label: "Rendiciones", icon: Package },
      { href: "/fondo-fijo", label: "Fondo Fijo", icon: Landmark },
      { href: "/impuestos-servicios", label: "Impuestos (DDJJ, SICORE, IIBB)", icon: Receipt },
    ],
  },
  {
    label: "Proveedores",
    icon: ArrowDownCircle,
    items: [
      { href: "/proveedores", label: "Maestro proveedores", icon: Users },
      { href: "/facturas-recibidas", label: "Facturas Recibidas", icon: ArrowDownCircle },
      { href: "/ordenes-pago", label: "Órdenes de pago", icon: CreditCard },
      { href: "/cuentas-corrientes", label: "Cuentas Corrientes", icon: BookOpen },
      { href: "/tipo-cambio", label: "Tipo de cambio", icon: DollarSign },
    ],
  },
  {
    label: "Facturación",
    icon: ArrowUpCircle,
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/facturas-emitidas", label: "Facturas Emitidas", icon: ArrowUpCircle },
      { href: "/creditos-cobranzas", label: "Créditos y Cobranzas", icon: UserCheck },
    ],
  },
  {
    label: "Contabilidad",
    icon: BookOpen,
    items: [
      { href: "/libro-iva", label: "Libro IVA", icon: Receipt },
      { href: "/plan-cuentas", label: "Plan de cuentas", icon: BookMarked },
      { href: "/asientos", label: "Asientos", icon: ListOrdered },
      { href: "/periodos", label: "Períodos", icon: Clock },
      { href: "/conciliacion/diferencias", label: "Diferencias con ARCA", icon: GitCompare },
      { href: "/conciliacion", label: "Importar ARCA (cruce)", icon: GitCompare },
      { href: "/bandeja", label: "Bandeja de revisión", icon: Inbox },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
      { href: "/retenciones-config", label: "Config. retenciones", icon: Percent },
      { href: "/reglas-clasificacion", label: "Reglas de clasif.", icon: Filter },
    ],
  },
  {
    label: "Comercial",
    icon: BarChart2,
    items: [
      { href: "/comercial/dashboard", label: "Dashboard Comercial", icon: BarChart2 },
      { href: "/comercial/acuerdos", label: "Acuerdos", icon: FileText },
      { href: "/comercial/comisiones", label: "Comisiones", icon: Percent },
      { href: "/comercial/comerciales", label: "Comerciales", icon: UserCheck },
    ],
  },
  {
    label: "Inventario",
    icon: Boxes,
    items: [
      { href: "/stock", label: "Stock", icon: Boxes },
      { href: "/inversiones", label: "Inversiones", icon: PiggyBank },
    ],
  },
  {
    label: "RRHH",
    icon: UserCheck,
    items: [
      { href: "/rrhh/empleados", label: "Empleados", icon: Users },
      { href: "/rrhh/liquidaciones", label: "Liquidaciones", icon: FileText },
    ],
  },
  {
    label: "Administración",
    icon: BrainCircuit,
    items: [
      { href: "/vencimientos", label: "Vencimientos", icon: Calendar },
      { href: "/cashflow", label: "Cash Flow", icon: TrendingUp },
      { href: "/minutas", label: "Minutas", icon: FileCheck2 },
      { href: "/arca-emision", label: "ARCA — Emisión CAE", icon: Stamp },
      { href: "/consultas-ia", label: "Consultas de análisis", icon: BrainCircuit },
    ],
  },
  {
    label: "Sistema",
    icon: ShieldCheck,
    items: [
      { href: "/importacion", label: "Importación", icon: Upload },
      { href: "/usuarios", label: "Usuarios", icon: ShieldCheck, adminOnly: true },
      { href: "/configuracion-drive", label: "Google Drive", icon: HardDrive, adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: '#0f2340',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#185fa5',
            borderRadius: '8px',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <RefreshCw size={18} color="white" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'white', letterSpacing: '-0.3px' }}>
            ContaFlow
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(item => !(item as any).adminOnly || isAdmin);
          if (items.length === 0) return null;
          const GIcon = (group as any).icon;
          const hasActive = items.some(it => pathname === it.href || pathname.startsWith(it.href + '/'));
          const isOpen = open[group.label] ?? hasActive;
          return (
          <div key={group.label} style={{ marginBottom: '2px' }}>
            <button
              type="button"
              onClick={() => setOpen(o => ({ ...o, [group.label]: !isOpen }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                padding: '9px 20px', fontSize: '13px', fontWeight: 600,
                color: hasActive ? 'white' : 'rgba(255,255,255,0.8)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              {GIcon && <GIcon size={15} style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1 }}>{group.label}</span>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (pathname.startsWith(item.href + '/') && !items.some(o => o.href.length > item.href.length && (pathname === o.href || pathname.startsWith(o.href + '/'))));
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '6px 20px 6px 44px', fontSize: '12.5px',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'white' : 'rgba(255,255,255,0.6)',
                    background: active ? 'rgba(24,95,165,0.5)' : 'transparent',
                    borderRight: active ? '2px solid #185fa5' : '2px solid transparent',
                  }}>
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* User */}
      <div style={{
        padding: '14px 20px',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'white' }}>
            {session?.user?.name}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            {(session?.user as any)?.role === 'admin' ? 'Administrador' : 'Contador'}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '7px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer',
            width: '100%',
            fontFamily: 'inherit',
          }}
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
