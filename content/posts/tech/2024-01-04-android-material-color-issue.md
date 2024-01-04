---
title: 记解决MaterialButton背景颜色与设置值不同
comments: true
date: 2024-01-04 22:02:30 +0800
tags: [android]
---

最近的开发过程中，因为设计的风格采用了Android的Material风格，因此我们在项目开发过程中也使用了Android 的Material组件和主题，但是开发过程中法使用MaterialButton的时候，我们给按钮设置的背景颜色和实际展示的背景颜色不一样。网上搜索了一番也没找到原因，于是便开始查阅MateriButton的代码。

<!--more-->


![期望的背景](/images/materialbutton-background-correct.png)
![实际的背景](/images/materialbutton-background-wrong.png)

经过一番研读终于找到原因，最终通过在style文件中添加如下设置解决。
```xml
<item name="elevationOverlayEnabled">false</item>
```

### MaterialButton介绍
Google在Material库中给我们提供了MaterialButton组件，我们可以通过设置很多属性来设置它的样式，仅仅背景就可以设置它的边框，背景的圆角，背景的颜色，甚至可以自己设置背景的形状，除此之外还能设置文字样式，按钮上的图标等等。因为我们今天的主题是关于背景的问题的，这里我们仅仅介绍背景设置相关的东西。

正常情况下，对于一个Android的View我们可以通过设置`setBackground()` `setBackgroundColor()` `setBackgroundResource()`等方法来设置View的背景，而MaterialButton为了让我们能够直接修改颜色，设置圆角，则重写了`setBackgroundColor()`方法，实现如下：
```java
public void setBackgroundColor(@ColorInt int color) {  
  if (isUsingOriginalBackground()) {  
    materialButtonHelper.setBackgroundColor(color);  
  } else {  
    // If default MaterialButton background has been overwritten, we will let View handle  
    // setting the background color.    super.setBackgroundColor(color);  
  }  
}
```

通过查阅代码，我们可以看到MaterialButton内部通过MaterialButtonHelper这个类来管理它的背景，如果我们没有通过setBackground给这个Button设置一个背景Drawable，MaterialButtonHelper会帮我们创建一个Drawable，当我们调用 setBackgroundColor的时候，实际上也会在MaterialButtonHelper内部处理，至于MaterialButtonHelper如何创建BackgroundDrawabale的流程，可以自行去看源码。

### 修改背景颜色的具体过程

上面说到的MaterialButtonHelper创建的背景Drawable就是一个`MaterialShapeDrawable`，前面的`setBackgroundColor`调用后实际上会调用到MaterialShapeDrawable的`setTintList()`方法来修改背景的颜色，实际上就是使用了Tint来修改我们的背景，在draw方法中我们可以看到如下的代码：
```java
fillPaint.setColorFilter(tintFilter);
```
以上代码实现来背景颜色的修改。

在setTintList()的代码中和调用的函数中，我们发现了这样一行代码它修改了`tintFilter`这个变量。
```java
tintFilter =  
    calculateTintFilter(  
        drawableState.tintList,  
        drawableState.tintMode,  
        fillPaint,  
        /* requiresElevationOverlay= */ true);
```

此处的tintList为我们刚刚设置的颜色，tintMode默认值是SRC_IN均不为空，该方法内部又调用了`calculateTintColorTintFilter()`方法。

到这里我们总结一下，setBackgroud是通过tint来修改了背景的颜色，tint的实现其实就是使用了Android画笔的颜色混合滤镜(PorterDuffColorFilter)来实现的。

### 背景颜色为什么与设置的不同？

```java
private PorterDuffColorFilter calculateTintColorTintFilter(  
    @NonNull ColorStateList tintList,  
    @NonNull PorterDuff.Mode tintMode,  
    boolean requiresElevationOverlay) {  
  int tintColor = tintList.getColorForState(getState(), Color.TRANSPARENT);  
  if (requiresElevationOverlay) {  
    tintColor = compositeElevationOverlayIfNeeded(tintColor);  
  }  
  resolvedTintColor = tintColor;  
  return new PorterDuffColorFilter(tintColor, tintMode);  
}
```

以上是`calculateTintColorTintFilter`方法的代码，我们知道requiresElevationOverlay总是`true`，那就一定会执行到`compositeElevationOverlayIfNeeded`，那就说明这个方法内部把我们的颜色修改了，查看其实现，果然如此，代码如下：
```java
protected int compositeElevationOverlayIfNeeded(@ColorInt int backgroundColor) {  
  float elevation = getZ() + getParentAbsoluteElevation();  
  return drawableState.elevationOverlayProvider != null  
      ? drawableState.elevationOverlayProvider.compositeOverlayIfNeeded(  
          backgroundColor, elevation)  
      : backgroundColor;  
}
```

翻阅代码我们可以看到drawableState是在Drawable创建的时候就创建了，而elevationOverlayProvider则是在MaterialButtonHelper中调用drawable的initializeElevationOverlay方法来初始化的，为`ElevationOverlayProvider`,而正是它的compsiteOverlayIfNeeded方法来变化了颜色。

### 修改颜色为我们设置的颜色
看到这里，首先想到是吧这个elevationOverlayProvider设置为null，那我们不就不会调用这个方法，颜色也就是我们最初设置的颜色了吗。然而，我们没法在MaterialButton中或者它的子类中去拿到Drawable的DrawableState，因此只能作罢。

再来继续看，ElevationOverlayProvider的compositeOverlayIfNeeded方法，它既然有个IfNeeded，那看来也不是一定会改变颜色了，继续看它的实现。
```java
public int compositeOverlayIfNeeded(@ColorInt int backgroundColor, float elevation) {  
  if (elevationOverlayEnabled && isThemeSurfaceColor(backgroundColor)) {  
    return compositeOverlay(backgroundColor, elevation);  
  } else {  
    return backgroundColor;  
  }  
}
```
可以看到满足elevationOverlayEnabled且 backgroudColor和themSurfaceColor相同的情况下才会改变颜色，原来我设置的按钮颜色和主题中设置的colorSurface相同，此处我不可能去修改按钮颜色，我们只能去看看elevationOverlayEnabled能否修改，查看ElevationOverlayProvider的源码可以看到初始化的时候通过如下代码初始化了该值。
```
MaterialAttributes.resolveBoolean(context, R.attr.elevationOverlayEnabled, false)
```

看到这里，我们也就知道该如何解决我们的问题了，也就是在AppTheme或者当前Activity的Theme中修改`elevationOverlayEnabled` 为false。

除了Button之外，Material的其他一些组件也有同样使用这个属性来设置是否修改颜色的，遇到的时候也可以同样的方式解决。