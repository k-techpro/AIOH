import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { Card } from "../src/components/ui";
import { useTheme } from "../src/theme/theme";
import { formatDateTime } from "../src/utils/format";

export default function ActivityLog(){const {colors}=useTheme(),router=useRouter(),{shopId}=useAppStore(),activities=useMockStore(s=>s.activities).filter(item=>shopId==="all"||item.branchId===shopId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));return <SafeAreaView edges={["top"]} style={{flex:1,backgroundColor:colors.surface}}><View style={{padding:20,flexDirection:"row",alignItems:"center",gap:12}}><Pressable onPress={()=>router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface}/></Pressable><View><Text style={{color:colors.onSurface,fontSize:22,fontWeight:"700"}}>Activity Log</Text><Text style={{color:colors.muted,fontSize:12}}>Live actions for the active branch</Text></View></View><ScrollView contentContainerStyle={{padding:20,paddingTop:0,gap:10}}>{activities.map(item=><Card key={item.id}><Text style={{color:colors.onSurface,fontWeight:"700"}}>{item.action.replace(/_/g," ")}</Text><Text style={{color:colors.muted,fontSize:13,marginTop:4}}>{item.description}</Text><Text style={{color:colors.muted,fontSize:11,marginTop:8}}>{formatDateTime(item.createdAt)}</Text></Card>)}{!activities.length&&<Card><Text style={{color:colors.muted}}>No activity recorded for this branch yet.</Text></Card>}</ScrollView></SafeAreaView>}
