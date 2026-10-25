import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Image, View, type ActivityIndicatorProps } from "react-native";
const source = require("../../assets/images/retailprime-logo.png");
export function BrandMark({ size = 40 }: { size?: number }) {
  return <View accessible accessibilityLabel="AIOH RetailPrime" style={{ width:size, height:size, borderRadius:size/4, overflow:"hidden", backgroundColor:"#05091c" }}><Image source={source} style={{ position:"absolute", width:size*2.09, height:size*2.09, left:-size*.53, top:-size*.27 }} /></View>;
}
export function BrandLoader({ size = "small", style, animating = true, hidesWhenStopped = true, accessibilityLabel = "Loading", ...rest }: ActivityIndicatorProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      if (!alive) return;
      animation?.stop(); opacity.setValue(1);
      if (!reduced && animating) {
        animation = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue:.45, duration:900, useNativeDriver:true }), Animated.timing(opacity, { toValue:1, duration:900, useNativeDriver:true })]));
        animation.start();
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(true));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
    return () => { alive = false; animation?.stop(); subscription.remove(); };
  }, [animating, opacity]);
  if (!animating && hidesWhenStopped) return null;
  return <View style={[{ alignItems:"center", justifyContent:"center" }, style]} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} testID={rest.testID}><Animated.View style={{ opacity }}><BrandMark size={typeof size === "number" ? size : size === "large" ? 88 : 32} /></Animated.View></View>;
}
