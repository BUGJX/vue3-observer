import { reactive } from "./reactive.js";
import { effect } from "./effect.js";
import { ref } from "./ref.js";
import { computed } from "./computed.js";

// const state = ref(1);
// effect(() => {
//   console.log("effect", state.value);
// });
// state.value++;

const obj = reactive({
  a: 1,
  b: 2,
});

const sum = computed(() => {
  console.log("computed");
  return obj.a + obj.b;
});

effect(() => {
  console.log("render", sum.value);
});

obj.a++;

// console.log(sum.value);
// console.log(sum.value);
// console.log(sum.value);

// obj.a++
// obj.a++
// obj.a++

// console.log(sum.value);

// const sum1 = computed({
//   get() {
//     console.log("computed");
//     return state.a + state.b;
//   },
// });

// 目标：函数与函数运行过程中用到的标记数据建立对应关系
// 1.监听数据的读写 (监听、读->依赖收集、写->派发更新)
// 2.关联数据和函数

// 代理对象：（targetMap:{对象：代理}）
// 1.如果不是对象，直接返回
// 2.如果已经代理过了，直接返回代理
// 3.没有代理过，建立对应关系并返回代理

// 1.拦截get操作
// 1.1：使用reflect.get返回相应属性值并进行依赖收集
// 1.2：如果属性值还是一个对象，继续进行代理，完成深度代理
// 1.3：代理的是一个数组时([1,{}, 2].includes({}))
// 1.3.1：对于includes、indexOf、lastIndexOf，先在代理对象中找，找不到再去原始对象中重新找一遍
// 1.3.2：对于push、pop、shift、unshift、splice(方法内部会读到length)，只进行派发更新，暂停依赖收集，调用结束后，恢复依赖收集，最后返回改动后的数组

// 2.拦截has操作
// 2.1：in关键字，对于对象调用的是hasProperty方法，对应到proxy的has方法，拦截has方法进行依赖收集

// 3.拦截ownKeys操作，
// 3.1：for...in、Object.keys()、Object.entries()、Object.values()，对于对象调用的是ownPropertyKeys方法，对应到proxy的ownKeys方法进行依赖收集

// 4.拦截set操作
// 4.1：使用reflect.set进行修改并返回
// 4.2：细化操作类型(set/add),使用hasOwnProperty判断(不使用in关键字判断，是为了确保只检查对象的自身属性，而不包括原型链上的属性)
// 4.3：设置不成功，直接返回
// 4.4：值有变化(使用Object.is()判断，在记录旧值时使用target[key]，不使用reflect，是为了避免触发依赖收集)或者新增属性才派发更新
// 4.5：代理的是一个数组时(arr = [1,2,3])，且数组前后长度发生变化
// 4.5.1：设置的不是length属性(下标赋值arr[4] = 5)，但是相当于隐式改变了length，手动触发进行依赖收集
// 4.5.2：设置的是length属性(arr.length = 2)，数组长度变大可以正常派发更新，数组长度变小时，找到被删除的下标，手动触发派发更新

// 5.拦截deleteProperty操作
// 5.1：使用reflect.deleteProperty进行删除并返回
// 5.2：原先有但是现在没有的属性(使用hasOwnProperty判断)，且删除成功，才派发更新

// 建立数据和函数的对应关系

// 1.依赖收集：建立对应关系
// WeakMap {
//   target (对象) => Map {
//     key (属性) => Map {
//       type (操作类型) => Set {
//         effectFn (依赖的副作用函数)
//       }
//     }
//   }
// }
// 使用effect函数用来管理副作用的，可以用来注册、执行、清理副作用。
// 通过lazy参数控制是否立即执行副作用，默认立即执行
// 通过scheduler参数控制派发更新的行为，默认直接运行副作用，否则执行调度器中的函数
// 维护一个effectStack栈，在副作用函数执行的过程中，它会将当前执行的副作用函数压入栈中，并在执行完毕后从栈中弹出，防止无限循环确保依赖收集的准确性。期间会调用cleanup函数清理之前的副作用，防止内存泄漏。
// 维护一个activeEffect变量，用来标记当前正在执行的副作用函数。

// 2.派发更新
// 2.1：找到对应函数依次运行(getEffectFns(target, key, type))，期间需要将派发更新的操作行为与依赖收集的操作行为建立对应关系
// 2.2：当前派发更新的函数和依赖收集的函数是同一个，则不执行派发更新操作

