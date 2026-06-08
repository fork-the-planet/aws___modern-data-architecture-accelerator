# MDAA Naming

This package defines an interface for MDAA-compatible naming implementations, along with a default implementation. Naming implementations will be passed the MDAA CDK App Context in order to initialize themselves based on any context specified in the MDAA execution environment.

## Resource Type Support

The `MdaaResourceType` enum and `withResourceType()` method allow custom naming implementations to produce resource-type-aware names. The default implementation is a no-op — it ignores the resource type and returns names unchanged, preserving backwards compatibility.

The example output below is only achievable via a custom implementation that overrides `withResourceType()` (see [CUSTOMIZATION.md](../../../CUSTOMIZATION.md)). Out of the box, the default implementation will produce the same name regardless of which `MdaaResourceType` value is supplied.

```typescript
// With a custom impl that overrides withResourceType (see CUSTOMIZATION.md):
const naming = customNaming.withResourceType(MdaaResourceType.S3_BUCKET);
const bucketName = naming.resourceName('my-data');
// → "aw-dev-s3-dpl-retail-datalake-my-data"
```

See [CUSTOMIZATION.md](../../../CUSTOMIZATION.md) for full examples.
