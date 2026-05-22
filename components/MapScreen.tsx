'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicOffice } from '@/lib/offices';
import { PasswordModal } from './PasswordModal';

const PragueMap = dynamic(() => import('./PragueMap').then((m) => m.PragueMap), {
  ssr: false,
  loading: () => <div className="boot-stub">$ booting map…</div>,
});

export function MapScreen({
  offices,
  unlockedIds,
}: {
  offices: PublicOffice[];
  unlockedIds: string[];
}) {
  const [pwdFor, setPwdFor] = useState<PublicOffice | null>(null);
  const router = useRouter();

  const onOfficeClick = (office: PublicOffice) => {
    if (unlockedIds.includes(office.id)) router.push(`/office/${office.id}`);
    else setPwdFor(office);
  };

  return (
    <div className="map-screen map-screen--matrix">
      <div className="map-overlay map-overlay--top">
        <div className="map-header">
          <div className="term-line">
            <span>$ ssh menu@prague --list-offices</span>
            <span className="term-line-status">[ {offices.length} HOSTS ]</span>
          </div>
          <h1 className="map-title">
            <span className="glitch" data-text="Vyberte kancelář">Vyberte kancelář</span>
            <span className="caret" aria-hidden="true" />
          </h1>
          <div className="map-sub">&gt;&gt;&gt; KLIKNĚTE NA PIN PRO PŘIHLÁŠENÍ</div>
        </div>
      </div>

      <PragueMap offices={offices} unlockedIds={unlockedIds} onOfficeClick={onOfficeClick} />

      <div className="map-overlay map-overlay--bottom">
        <div className="map-legend">
          <span className="legend-item">
            <span className="legend-dot legend-dot--office" aria-hidden="true" />
            [ KANCELÁŘ ]
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-dot--rest" aria-hidden="true" />
            [ RESTAURACE ]
          </span>
        </div>
      </div>

      {pwdFor && <PasswordModal office={pwdFor} onCancel={() => setPwdFor(null)} />}
    </div>
  );
}
