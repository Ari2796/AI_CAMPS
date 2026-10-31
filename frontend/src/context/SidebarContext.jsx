import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_desktop_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setIsOpen(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_desktop_open', String(next));
      return next;
    });
  };

  const closeSidebar = () => {
    setIsOpen(false);
    localStorage.setItem('sidebar_desktop_open', 'false');
  };

  const openSidebar = () => {
    setIsOpen(true);
    localStorage.setItem('sidebar_desktop_open', 'true');
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, closeSidebar, openSidebar, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};
