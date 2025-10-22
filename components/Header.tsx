"use client";

import React, { useState } from "react";
import Link from "next/link";
import { geistMono } from "@/app/fonts";
import { TbInfoCircleFilled } from "react-icons/tb";
import { cn } from "@/lib/utils/utils";
import { TbX } from "react-icons/tb";

export function Header() {
  const [isCardVisible, setIsCardVisible] = useState(false);

  const handleInfoClick = () => {
    setIsCardVisible(true);
  };

  const handleClose = () => {
    setIsCardVisible(false);
  };

  return (
    <div className="flex flex-row w-full justify-between items-center px-3 py-2 bg-zinc-50 border-b border-zinc-100">
      <h1 className={cn(geistMono.className, "font-extrabold")}>
        <Link href="/">Characify</Link>
      </h1>
      <div className="flex flex-row gap-4 justify-center items-center">
        <button onClick={handleInfoClick}>
          <TbInfoCircleFilled
            size={24}
            className="text-neutral-content hover:text-neutral cursor-pointer"
          />
        </button>
      </div>

      {isCardVisible && (
        <>
          <div
            className="fixed inset-0 bg-black/50 cursor-default z-[99999]"
            onClick={handleClose}
          ></div>
          <div className="fixed inset-0 flex justify-center items-center z-[100000]">
            <div className="bg-white p-4 rounded shadow-lg space-y-4 max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex flex-row items-center justify-between mb-4">
                <p className="font-semibold text-lg"></p>

                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <TbX size={20} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
