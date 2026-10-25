import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { neonRepository } from '../services/neonRepository';
import type { Scope } from '../services/neon/client';
type Row = Record<string, any>;
export function useNeonPage(scope: Scope | null, entity: string, search: string | null = null) {
  const key = JSON.stringify([scope?.businessId,scope?.shopId,entity,search]);
  const generation=useRef(0), paging=useRef(false), subscription=useRef<ReturnType<typeof neonRepository.subscribePage>|null>(null);
  const [state,setState]=useState({key,rows:[] as Row[],nextCursor:null as string|null,hasMore:false,loading:true,error:null as Error|null});
  useEffect(()=>{
    const current=++generation.current;paging.current=false;
    setState({key,rows:[],nextCursor:null,hasMore:false,loading:!!scope?.businessId,error:null});
    if(!scope?.businessId)return undefined;
    const stop=neonRepository.subscribePage(scope,entity,page=>{
      if(generation.current===current)setState({key,rows:page.records,nextCursor:page.next_cursor,hasMore:page.has_more,loading:false,error:null});
    },error=>{if(generation.current===current)setState(s=>({...s,loading:false,error}));},{search,limit:100});
    subscription.current=stop;
    const foreground=AppState.addEventListener('change',value=>{if(value==='active')void stop.refresh();});
    return()=>{generation.current=current+1;stop.unsubscribe();subscription.current=null;foreground.remove();};
    // The key contains every immutable request-scope value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  const loadNext=useCallback(async()=>{
    if(paging.current||!state.hasMore||state.key!==key||!scope)return;
    const current=generation.current;paging.current=true;
    try{const page=await neonRepository.listPage(scope,entity,{search,limit:100,cursor:state.nextCursor});
      if(generation.current===current)setState(s=>({...s,rows:[...new Map([...s.rows,...page.records].map(r=>[r.id,r])).values()],nextCursor:page.next_cursor,hasMore:page.has_more,error:null}));
    }catch(error){if(generation.current===current)setState(s=>({...s,error:error instanceof Error?error:new Error('Neon request failed')}));}
    finally{if(generation.current===current)paging.current=false;}
  },[key,scope,entity,search,state.hasMore,state.key,state.nextCursor]);
  return{...state,rows:state.key===key?state.rows:[],loadNext,refresh:()=>subscription.current?.refresh()};
}
