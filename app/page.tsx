import Workspace from "@/components/workspace";

/**
 * Sunucu bileşeni: başlangıç içeriği ORM kataloğundaki örneklerden geliyor,
 * dil ise kök layout'taki çerezden. Editör, canvas ve AI paneli etkileşimli
 * olduğu için `Workspace` altındaki her şey Client Component'tir.
 */
export default function Home() {
  return <Workspace />;
}
