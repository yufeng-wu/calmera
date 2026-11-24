import usePageExit from "@/hooks/usePageExit";
import GuideGallery from "@/components/GuideGallery";

export default function CalmeraGuideScreen({ calmeraPreview = false }) {
  const leave = usePageExit(calmeraPreview ? "/ui-gallery" : "/dashboard");
  return <GuideGallery onBack={leave} />;
}
