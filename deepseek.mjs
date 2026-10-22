export const DEFAULT_MODEL='deepseek-flash';

export async function requestDeepSeek({key,model=DEFAULT_MODEL,instructions,input,fetchImpl=fetch}){
 const response=await fetchImpl('https://api.deepseek.com/chat/completions',{
  method:'POST',
  headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(input)}],max_tokens:1100,stream:false,thinking:{type:'disabled'}}),
  signal:AbortSignal.timeout(45000)
 });
 if(!response.ok)throw Error(response.status===401?'DeepSeek key was rejected. Check DEEPSEEK_API_KEY in the server configuration.':response.status===429?'DeepSeek is temporarily rate limited. Please retry.':'DeepSeek is unavailable. Please retry.');
 const result=await response.json();
 const choice=result.choices?.[0];
 if(choice?.finish_reason==='length')throw Error('DeepSeek’s response was cut short. Please retry.');
 const text=choice?.message?.content;
 if(typeof text!=='string'||!text.trim())throw Error('No DeepSeek response returned. Please retry.');
 return text;
}
