import React, { createContext, useContext, useState } from 'react';

const Ctx = createContext({ showDealers: false, toggle: () => {} });

export function DealerProvider({ children }) {
  const [showDealers, setShow] = useState(
    () => localStorage.getItem('cal_showDealers') === 'true'
  );

  function toggle() {
    setShow(v => {
      const next = !v;
      localStorage.setItem('cal_showDealers', String(next));
      return next;
    });
  }

  return <Ctx.Provider value={{ showDealers, toggle }}>{children}</Ctx.Provider>;
}

export function useDealers() {
  return useContext(Ctx);
}
