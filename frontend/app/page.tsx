"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { ABI } from "../components/abi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, Coins } from "lucide-react";
import { toast } from "sonner";

export default function Page() {
  const { address, isConnected } = useAccount();

  const [mintAmount, setMintAmount] = useState("0");
  const [redeemAmount, setRedeemAmount] = useState("0");

  const [loadingApprove, setLoadingApprove] = useState(false);
  const [loadingMint, setLoadingMint] = useState(false);
  const [loadingRedeem, setLoadingRedeem] = useState(false);

  const { writeContract } = useWriteContract();

  const gof = process.env.NEXT_PUBLIC_GOF_ADDRESS as `0x${string}`;
  const usdc = process.env.NEXT_PUBLIC_COLLATERAL_ADDRESS as `0x${string}`;

  const { data: gofBalance } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { refetchInterval: 4000 }
  });

  const { data: collateralBalance } = useReadContract({
    address: usdc,
    abi: ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { refetchInterval: 4000 }
  });

  const { data: requiredCollateral } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "requiredCollateralForMint",
    args: [mintAmount ? parseUnits(mintAmount, 18) : BigInt(0)],
    query: { refetchInterval: 4000 }
  });

  const { data: allowance } = useReadContract({
    address: usdc,
    abi: ABI,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      gof,
    ],
    query: { refetchInterval: 4000 }
  });

  const isApproved =
    allowance !== undefined &&
    requiredCollateral !== undefined &&
    allowance >= requiredCollateral;

  const { data: goldPriceData } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "getGoldPrice",
    query: { refetchInterval: 4000 }
  });

  const { data: collateralRatioPct } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "collateralRatioPct",
    query: { refetchInterval: 4000 }
  });

  const { data: redeemFeeBps } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "redeemFeeBps",
    query: { refetchInterval: 4000 }
  });

  let redeemEstimate = 0;
  try {
    if (
      goldPriceData &&
      collateralRatioPct &&
      redeemFeeBps &&
      Number(redeemAmount) > 0
    ) {
      const price18 = goldPriceData[0];
      const amountWei = parseUnits(redeemAmount, 18);

      let value18 = (amountWei * BigInt(price18)) / BigInt(1e18);
      let collateral18 = (value18 * BigInt(collateralRatioPct)) / BigInt(100);
      let collateral6 = collateral18 / BigInt(1e12);
      let fee = (collateral6 * BigInt(redeemFeeBps)) / BigInt(10000);

      redeemEstimate = Number(collateral6 - fee) / 1e6;
    }
  } catch {}

  const handleApprove = async () => {
    try {
      setLoadingApprove(true);
      await writeContract({
        address: usdc,
        abi: ABI,
        functionName: "approve",
        args: [gof, requiredCollateral ?? BigInt(0)],
      });
      toast.success("Collatéral approuvé");
    } catch {
      toast.error("Échec de l'approbation");
    } finally {
      setLoadingApprove(false);
    }
  };

  const handleMint = async () => {
    try {
      setLoadingMint(true);
      await writeContract({
        address: gof,
        abi: ABI,
        functionName: "mintWithCollateral",
        args: [parseUnits(mintAmount, 18)],
      });
      toast.success("Mint réussi");
    } catch {
      toast.error("Échec du mint");
    } finally {
      setLoadingMint(false);
    }
  };

  const handleRedeem = async () => {
    try {
      setLoadingRedeem(true);
      await writeContract({
        address: gof,
        abi: ABI,
        functionName: "redeem",
        args: [parseUnits(redeemAmount, 18)],
      });
      toast.success("Redeem réussi");
    } catch {
      toast.error("Échec du redeem");
    } finally {
      setLoadingRedeem(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
            GoldOracle
          </h1>
          <ConnectButton />
        </div>
      </div>

      <div className="p-12 flex justify-center">
        <div className="w-full max-w-2xl">
          {/* Balances */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <Card className="shadow-sm hover:shadow-md">
              <CardContent className="flex items-center gap-4 h-full py-6">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm text-slate-500">Solde GOF</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {gofBalance
                      ? (Number(gofBalance) / 1e18).toFixed(6)
                      : "0.00"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md">
              <CardContent className="flex items-center gap-4 h-full py-6">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm text-slate-500">Solde USDC</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {collateralBalance
                      ? (Number(collateralBalance) / 1e6).toFixed(2)
                      : "0.00"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mint */}
          <Card className="shadow-lg mb-8">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl text-slate-900">
                Mint Tokens
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <Input
                type="number"
                min="0"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                className="bg-slate-50 border-slate-200 h-12 text-lg"
              />

              <p className="text-xs text-slate-500">
                Collatéral requis : {(Number(requiredCollateral ?? BigInt(0)) / 1e6).toFixed(4)} USDC
              </p>

              <Button
                onClick={handleApprove}
                disabled={!isConnected || loadingApprove || Number(mintAmount) <= 0}
                className="bg-neutral-950 text-white hover:bg-neutral-700 h-12"
              >
                {loadingApprove ? "Approbation..." : "Approve Collatéral"}
              </Button>

              <Button
                onClick={handleMint}
                disabled={!isApproved || loadingMint}
                className="bg-neutral-950 hover:bg-neutral-700 text-white h-12"
              >
                {loadingMint ? "Mint en cours..." : "Mint"}
              </Button>
            </CardContent>
          </Card>

          {/* Redeem */}
          <Card className="shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl text-slate-900">Redeem Tokens</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <Input
                type="number"
                min="0"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                className="bg-slate-50 border-slate-200 h-12 text-lg"
              />

              <p className="text-xs text-slate-500">
                ≈ Vous recevrez : {redeemEstimate.toFixed(4)} USDC
              </p>

              <Button
                onClick={handleRedeem}
                disabled={!isConnected || loadingRedeem || Number(redeemAmount) <= 0}
                className="bg-neutral-950 hover:bg-neutral-700 text-white h-12"
              >
                {loadingRedeem ? "Redeem en cours..." : "Redeem GOF → USDC"}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
