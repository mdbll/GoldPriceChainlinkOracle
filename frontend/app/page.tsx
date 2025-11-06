"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { ABI } from "../components/abi";
import { NFT_ABI } from "../components/nftAbi";
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
  const nft = process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}`;
  const meta = process.env.NEXT_PUBLIC_NFT_META_CID as string;

  const [nftCid, setNftCid] = useState("");
  const [nftList, setNftList] = useState<any[]>([]);
  const [ownsNft, setOwnsNft] = useState(false);
  const [loadingNftApprove, setLoadingNftApprove] = useState(false);
  const [loadingNftMint, setLoadingNftMint] = useState(false);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const { data: gofBalance } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { refetchInterval: 4000 },
  });

  const { data: collateralBalance } = useReadContract({
    address: usdc,
    abi: ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { refetchInterval: 4000 },
  });

  const { data: requiredCollateral } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "requiredCollateralForMint",
    args: [mintAmount ? parseUnits(mintAmount, 18) : 0n],
    query: { refetchInterval: 4000 },
  });

  const { data: allowance } = useReadContract({
    address: usdc,
    abi: ABI,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", gof],
    query: { refetchInterval: 4000 },
  });

  const isApproved =
    allowance !== undefined &&
    requiredCollateral !== undefined &&
    allowance >= requiredCollateral;

  const { data: goldPriceData } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "getGoldPrice",
    query: { refetchInterval: 4000 },
  });

  const { data: collateralRatioPct } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "collateralRatioPct",
    query: { refetchInterval: 4000 },
  });

  const { data: redeemFeeBps } = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "redeemFeeBps",
    query: { refetchInterval: 4000 },
  });

  const rawMintPrice = useReadContract({
    address: nft,
    abi: NFT_ABI,
    functionName: "mintPrice",
    query: { refetchInterval: 4000 },
  }).data;

  const nftMintPrice: bigint = (rawMintPrice as bigint) ?? 0n;

  const rawNftAllowance = useReadContract({
    address: gof,
    abi: ABI,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", nft],
    query: { refetchInterval: 4000 },
  }).data;

  const nftAllowance: bigint = (rawNftAllowance as bigint) ?? 0n;

  const needsNftApproval = nftAllowance < nftMintPrice;

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

      let value18 = (amountWei * price18) / 1_000_000_000_000_000_000n;
      let collateral18 = (value18 * BigInt(collateralRatioPct)) / 100n;
      let collateral6 = collateral18 / 1_000_000_000_000n;
      let fee = (collateral6 * BigInt(redeemFeeBps)) / 10_000n;

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
        args: [gof, requiredCollateral ?? 0n],
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

  const handleApproveNft = async () => {
    try {
      setLoadingNftApprove(true);
      await writeContract({
        address: gof,
        abi: ABI,
        functionName: "approve",
        args: [nft, nftMintPrice],
      });
      toast.success("GOF approuvé");
    } catch {
      toast.error("Échec approbation NFT");
    } finally {
      setLoadingNftApprove(false);
    }
  };

  const handleMintNftManual = async () => {
    if (!nftCid) return toast.error("Ajoute un CID.");
    try {
      setLoadingNftMint(true);
      await writeContract({
        address: nft,
        abi: NFT_ABI,
        functionName: "mint",
        args: [nftCid],
      });
      toast.success("NFT minté");
      setNftCid("");
    } catch {
      toast.error("Échec mint NFT");
    } finally {
      setLoadingNftMint(false);
    }
  };

  const handleMintNftShop = async () => {
    try {
      setLoadingNftMint(true);
      await writeContract({
        address: nft,
        abi: NFT_ABI,
        functionName: "mint",
        args: [meta],
      });
      toast.success("Goldorak acheté");
    } catch {
      toast.error("Échec achat NFT");
    } finally {
      setLoadingNftMint(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const total = (await publicClient.readContract({
          address: nft,
          abi: NFT_ABI,
          functionName: "totalMinted",
        })) as bigint;

        const items: any[] = [];
        let owned = false;

        for (let i = 0; i < Number(total); i++) {
          const owner = (await publicClient.readContract({
            address: nft,
            abi: NFT_ABI,
            functionName: "ownerOf",
            args: [BigInt(i)],
          })) as `0x${string}`;

          if (owner.toLowerCase() !== (address ?? "").toLowerCase()) continue;

          const uri = (await publicClient.readContract({
            address: nft,
            abi: NFT_ABI,
            functionName: "tokenURI",
            args: [BigInt(i)],
          })) as string;

          const fixedUri = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
          const meta = await fetch(fixedUri).then((r) => r.json());
          const img = meta.image.replace("ipfs://", "https://ipfs.io/ipfs/");

          if (fixedUri.includes(meta)) owned = true;

          items.push({
            id: i,
            name: meta.name,
            description: meta.description,
            image: img,
          });
        }

        setOwnsNft(owned);
        setNftList(items);
      } catch (err) {
        console.log("Erreur fetch NFT:", err);
      }
    };

    load();
  }, [address, nft]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <h1 className="text-2xl font-semibold text-neutral-800">
            GoldOracle
          </h1>
          <ConnectButton />
        </div>
      </div>

      <div className="p-8 flex justify-center">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ------- COLONNE GAUCHE ------- */}
          <div className="space-y-6">
            <Card className="border border-neutral-200 shadow-sm">
              <CardHeader className="border-b border-neutral-200">
                <CardTitle className="text-lg text-neutral-800">
                  Vos Soldes
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <Coins className="w-6 h-6 text-neutral-700" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Solde GOF</p>
                    <p className="text-2xl font-semibold text-neutral-900">
                      {gofBalance
                        ? (Number(gofBalance) / 1e18).toFixed(6)
                        : "0.00"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-neutral-700" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Solde USDC</p>
                    <p className="text-2xl font-semibold text-neutral-900">
                      {collateralBalance
                        ? (Number(collateralBalance) / 1e6).toFixed(2)
                        : "0.00"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mint */}
              <Card className="border border-neutral-200 shadow-sm">
                <CardHeader className="border-b border-neutral-200">
                  <CardTitle className="text-lg text-neutral-800">
                    Mint Tokens
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col justify-between h-full gap-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      className="bg-white border border-neutral-300 h-11 text-neutral-800 flex-1"
                    />

                    <Button
                      onClick={handleApprove}
                      disabled={
                        !isConnected ||
                        loadingApprove ||
                        Number(mintAmount) <= 0
                      }
                      className="h-11 w-11 min-w-[44px] bg-neutral-900 text-white hover:bg-neutral-800 border border-neutral-900 flex items-center justify-center"
                    >
                      {loadingApprove ? (
                        <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-neutral-500">
                    Collatéral requis :{" "}
                    {(Number(requiredCollateral ?? 0n) / 1e6).toFixed(4)} USDC
                  </p>

                  <Button
                    className="bg-neutral-900 text-white hover:bg-neutral-800 h-11"
                    onClick={handleMint}
                    disabled={!isApproved || loadingMint}
                  >
                    {loadingMint ? "Mint..." : "Mint"}
                  </Button>
                </CardContent>
              </Card>

              {/* Redeem */}
              <Card className="border border-neutral-200 shadow-sm">
                <CardHeader className="border-b border-neutral-200">
                  <CardTitle className="text-lg text-neutral-800">
                    Redeem Tokens
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col justify-between h-full gap-4">
                  <Input
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    className="bg-white border border-neutral-300 h-11 text-neutral-800"
                  />

                  <p className="text-xs text-neutral-500">
                    ≈ Vous recevrez : {redeemEstimate.toFixed(4)} USDC
                  </p>

                  <Button
                    className="bg-neutral-900 text-white hover:bg-neutral-800 h-11"
                    onClick={handleRedeem}
                    disabled={
                      !isConnected || loadingRedeem || Number(redeemAmount) <= 0
                    }
                  >
                    {loadingRedeem ? "Redeem..." : "Redeem"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ------- COLONNE DROITE ------- */}
          <div className="space-y-6">
            {/* Boutique NFT */}
            <Card className="border border-neutral-200 shadow-sm">
              <CardHeader className="border-b border-neutral-200">
                <CardTitle className="text-lg text-neutral-800">
                  Boutique NFT Goldorak
                </CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col sm:flex-row gap-6">
                <img
                  src={`https://ipfs.io/ipfs/${meta}`}
                  className="w-full sm:w-1/2 rounded-lg object-cover border border-neutral-200"
                />

                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-800">
                      Goldorak #1
                    </h3>
                    <p className="text-sm text-neutral-500">
                      Rareté : Épique ⭐
                    </p>
                  </div>

                  {ownsNft ? (
                    <p className="text-green-600 font-medium text-center mt-4">
                      ✅ Déjà possédé
                    </p>
                  ) : needsNftApproval ? (
                    <Button
                      onClick={handleApproveNft}
                      className="bg-neutral-900 text-white hover:bg-neutral-800 h-11 mt-6 w-full"
                    >
                      Approve GOF
                    </Button>
                  ) : (
                    <div className="w-full">
                      <p className="mt-3 text-sm text-neutral-600">
                        Prix : {(Number(nftMintPrice) / 1e18).toFixed(8)} GOF
                      </p>

                      <Button
                        onClick={handleMintNftShop}
                        className="bg-neutral-900 text-white hover:bg-neutral-800 h-11 mt-4 w-full"
                      >
                        Acheter
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Galerie */}
            {nftList.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-neutral-800 mb-4">
                  Votre Collection
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {nftList.map((n) => (
                    <Card
                      key={n.id}
                      className="border border-neutral-200 shadow-sm"
                    >
                      <img
                        src={n.image}
                        className="w-full h-48 object-cover border-b border-neutral-200"
                      />
                      <CardContent className="py-4">
                        <h3 className="font-medium text-neutral-800">
                          {n.name}{" "}
                          <span className="text-xs text-neutral-500">
                            #{n.id}
                          </span>
                        </h3>
                        <p className="text-sm text-neutral-600">
                          {n.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
