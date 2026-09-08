import { ProductModel } from '../../../../domain/models/product.model';
import {
  buildActiveKey,
  buildCategoryActiveKey,
  buildNameSortKey,
  ProductItem,
} from '../tables/products.table';

export class ProductMapper {
  static toDomain(item: ProductItem): ProductModel {
    return {
      productId: item.productId,
      name: item.name,
      category: item.category,
      active: item.active,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItem(model: ProductModel): ProductItem {
    const nameLower = model.name.toLowerCase();
    return {
      productId: model.productId,
      name: model.name,
      nameLower,
      category: model.category,
      active: model.active,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      gsi1pk: buildCategoryActiveKey(model.category, model.active),
      gsi2pk: buildActiveKey(model.active),
      nameSortKey: buildNameSortKey(nameLower, model.productId),
    };
  }
}
